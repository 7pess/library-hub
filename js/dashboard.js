/* =====================================================================
   LibraryHub - dashboard logic
   ===================================================================== */
(function () {
  'use strict';

  // ---------- session ----------
  var store = localStorage.getItem('lh_token') ? localStorage : sessionStorage;
  var token = store.getItem('lh_token');
  var me = null;
  try { me = JSON.parse(store.getItem('lh_user') || 'null'); } catch (e) {}
  if (!token || !me) { location.replace('index.html'); return; }
  var isFaculty = me.role === 'faculty';

  var $ = function (id) { return document.getElementById(id); };
  var books = [], issues = [];
  var state = { view: 'overview', mode: 'grid', tab: 'active' };

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, bad) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, 2400);
  }

  function api(path, method, form) {
    var opts = { method: method || 'GET', headers: { 'X-Token': token } };
    if (form) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.body = Object.keys(form).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(form[k]);
      }).join('&');
    }
    return fetch(path, opts).then(function (r) {
      if (r.status === 401 && path !== 'api/login') { doLogout(true); throw new Error('Session expired'); }
      return r.json().then(function (d) {
        if (d && d.ok === false) throw new Error(d.error || 'Something went wrong');
        return d;
      });
    });
  }

  function doLogout(silent) {
    if (!silent) { try { api('api/logout', 'POST', {}); } catch (e) {} }
    localStorage.removeItem('lh_token'); localStorage.removeItem('lh_user');
    sessionStorage.removeItem('lh_token'); sessionStorage.removeItem('lh_user');
    location.replace('index.html');
  }

  // cover colours per category
  var PALETTE = {
    'Programming':      ['#2f3390', '#5a5fd6'],
    'Computer Science': ['#1d6f8a', '#3fb0c9'],
    'Mathematics':      ['#b02a37', '#e5646f'],
    'Electronics':      ['#8a5a00', '#e0a21a'],
    'Mechanical':       ['#3d4a5c', '#76889f'],
    'Biography':        ['#6a3d9a', '#a672d6'],
    'Fiction':          ['#a3412a', '#e5835f'],
    'Self Help':        ['#3f7d20', '#8fc43a'],
    'General':          ['#5b5e7a', '#9a9db8']
  };
  var EXTRA = [['#0f766e', '#34d3c0'], ['#9d174d', '#f472b6'], ['#854d0e', '#facc15'], ['#1e40af', '#60a5fa']];
  function colorsFor(cat) {
    if (PALETTE[cat]) return PALETTE[cat];
    var h = 0; for (var i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
    return EXTRA[h % EXTRA.length];
  }
  function barColor(cat) { return colorsFor(cat)[0]; }
  function coverStyle(cat) { var c = colorsFor(cat); return '--c1:' + c[0] + ';--c2:' + c[1]; }

  function myActiveIssue(bookId) {
    return issues.find(function (i) { return i.bookId === bookId && i.userId === me.id && !i.returned; });
  }

  function statusBadge(i) {
    if (i.returned) return '<span class="badge gray">Returned ' + esc(i.returnedOn) + '</span>';
    if (i.overdue) return '<span class="badge bad">Overdue ' + Math.max(1, -i.daysLeft) + ' day' + (-i.daysLeft === 1 ? '' : 's') + '</span>';
    if (i.daysLeft <= 3) return '<span class="badge warn">Due in ' + Math.max(0, i.daysLeft) + ' day' + (i.daysLeft === 1 ? '' : 's') + '</span>';
    return '<span class="badge ok">' + i.daysLeft + ' days left</span>';
  }

  // ---------- data ----------
  function load() {
    return Promise.all([api('api/books'), api('api/issues')]).then(function (r) {
      books = r[0]; issues = r[1];
      renderAll();
    }).catch(function (e) { if (e.message !== 'Session expired') toast(e.message, true); });
  }

  // ---------- navigation ----------
  var TITLES = { overview: 'Overview', catalogue: 'Book Catalogue', issued: isFaculty ? 'Issued Books' : 'My Books', add: 'Add New Book' };

  function go(view) {
    if (view === 'add' && !isFaculty) view = 'overview';
    if (!TITLES[view]) view = 'overview';
    state.view = view;
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + view; });
    document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.view === view); });
    $('pageTitle').textContent = TITLES[view];
    document.title = TITLES[view] + ' | LibraryHub';
    document.body.classList.remove('menu-open');
    window.scrollTo(0, 0);
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  }
  window.addEventListener('hashchange', function () { go(location.hash.slice(1)); });
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]');
    if (g) go(g.dataset.go);
  });

  // ---------- renderers ----------
  function renderAll() {
    renderOverview();
    renderFilters();
    renderCatalogue();
    renderIssues();
  }

  var ICONS = {
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };

  function stat(icon, num, label, color) {
    return '<div class="stat" style="--c:' + color + '"><div class="ico">' + ICONS[icon] + '</div><div><div class="num">' + num + '</div><div class="lbl">' + label + '</div></div></div>';
  }

  function renderOverview() {
    var h = new Date().getHours();
    var greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    var first = me.name.replace(/^(Prof\.|Dr\.)\s*/, '').split(' ')[0];
    $('heroHi').textContent = greet + ', ' + first + '!';
    $('today').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('avatar').textContent = first.charAt(0).toUpperCase();
    $('meName').textContent = me.name;
    $('meRole').textContent = isFaculty ? 'Faculty · ' + me.dept : 'Student · ' + me.id;

    var active = issues.filter(function (i) { return !i.returned; });
    var overdue = active.filter(function (i) { return i.overdue; });
    var totalCopies = books.reduce(function (s, b) { return s + b.copies; }, 0);
    var availCopies = books.reduce(function (s, b) { return s + b.available; }, 0);
    var cats = {};
    books.forEach(function (b) { cats[b.category] = (cats[b.category] || 0) + 1; });

    if (isFaculty) {
      $('heroLine').textContent = 'Here is how the library looks today.';
      $('heroSub').textContent = overdue.length
        ? overdue.length + ' book' + (overdue.length > 1 ? 's are' : ' is') + ' overdue. You can mark them as returned from the Issued Books page.'
        : 'Everything is on schedule. No overdue books right now.';
      $('heroSecond').textContent = 'Issued books';
      $('stats').innerHTML =
        stat('book', books.length, 'Book titles', 'var(--navy)') +
        stat('check', availCopies + ' / ' + totalCopies, 'Copies on shelf', 'var(--ok)') +
        stat('out', active.length, 'Currently issued', 'var(--warn)') +
        stat('alert', overdue.length, 'Overdue', 'var(--red)');
      $('dueTitle').textContent = 'Overdue & due soon';
    } else {
      var soon = active.filter(function (i) { return !i.overdue && i.daysLeft <= 3; });
      var history = issues.filter(function (i) { return i.returned; });
      $('heroLine').textContent = active.length ? 'You have ' + active.length + ' book' + (active.length > 1 ? 's' : '') + ' with you.' : 'Ready to find your next read?';
      $('heroSub').textContent = overdue.length
        ? 'Please return the overdue book' + (overdue.length > 1 ? 's' : '') + ' to avoid a fine of Rs. 2 per day.'
        : (3 - active.length) + ' more book' + (3 - active.length === 1 ? '' : 's') + ' can be issued on your account.';
      $('heroSecond').textContent = 'My books';
      $('stats').innerHTML =
        stat('book', active.length + ' / 3', 'Books with me', 'var(--navy)') +
        stat('clock', soon.length, 'Due within 3 days', 'var(--warn)') +
        stat('alert', overdue.length, 'Overdue', 'var(--red)') +
        stat('check', history.length, 'Books returned', 'var(--ok)');
      $('dueTitle').textContent = 'My due dates';
    }

    // category bars
    var keys = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
    var max = keys.length ? cats[keys[0]] : 1;
    $('catTotal').textContent = keys.length + ' categories';
    $('catBars').innerHTML = keys.map(function (k) {
      return '<div class="bar-row"><span>' + esc(k) + '</span><div class="track"><div class="fill" style="--c:' + barColor(k) + '" data-w="' + Math.round(cats[k] / max * 100) + '"></div></div><span class="n">' + cats[k] + '</span></div>';
    }).join('') || '<p class="muted">No books yet.</p>';
    setTimeout(function () {
      document.querySelectorAll('.fill').forEach(function (f) { f.style.width = f.dataset.w + '%'; });
    }, 30);

    // due list
    var list = active.slice().sort(function (a, b) { return a.daysLeft - b.daysLeft; }).slice(0, 5);
    $('dueList').innerHTML = list.length ? list.map(function (i) {
      var b = books.find(function (x) { return x.id === i.bookId; });
      return '<li><div class="mini" style="' + coverStyle(b ? b.category : 'General') + ';background:linear-gradient(150deg,var(--c1),var(--c2))"></div>' +
        '<div class="grow"><div class="t">' + esc(i.title) + '</div><div class="s">' + (isFaculty ? esc(i.userName) + ' · ' : '') + 'Due ' + esc(i.due) + '</div></div>' + statusBadge(i) + '</li>';
    }).join('') : '<li><div class="grow"><div class="t">Nothing due</div><div class="s">' + (isFaculty ? 'No books are currently issued.' : 'You have no books issued.') + '</div></div></li>';

    // new arrivals = highest ids
    var latest = books.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 4);
    $('arrivals').innerHTML = latest.map(function (b) {
      return '<a class="arr" href="#catalogue" data-find="' + esc(b.title) + '"><div class="cover" style="' + coverStyle(b.category) + '"><div class="ct">' + esc(b.title) + '</div><div class="ca">' + esc(b.author) + '</div></div><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.category) + '</div></a>';
    }).join('');

    // nav badge
    var mine = isFaculty ? active.length : active.length;
    $('issuedNavLabel').textContent = isFaculty ? 'Issued Books' : 'My Books';
    $('issuedCount').textContent = mine;
    $('issuedCount').hidden = mine === 0;
  }

  // ---- catalogue ----
  function renderFilters() {
    var cats = {};
    books.forEach(function (b) { cats[b.category] = 1; });
    var keys = Object.keys(cats).sort();
    var cur = $('fCat').value;
    $('fCat').innerHTML = '<option value="">All categories</option>' + keys.map(function (k) {
      return '<option' + (k === cur ? ' selected' : '') + '>' + esc(k) + '</option>';
    }).join('');
    $('catList').innerHTML = keys.map(function (k) { return '<option value="' + esc(k) + '">'; }).join('');
  }

  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('fCat').value, av = $('fAvail').value, sort = $('fSort').value;
    var out = books.filter(function (b) {
      if (cat && b.category !== cat) return false;
      if (av === 'in' && b.available < 1) return false;
      if (av === 'out' && b.available > 0) return false;
      if (q && (b.title + ' ' + b.author + ' ' + b.shelf + ' ' + b.category).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    out.sort(function (a, b) {
      if (sort === 'author') return a.author.localeCompare(b.author);
      if (sort === 'year') return b.year - a.year;
      if (sort === 'avail') return b.available - a.available;
      return a.title.localeCompare(b.title);
    });
    return out;
  }

  function stockHtml(b) {
    var cls = b.available === 0 ? 'out' : b.available === 1 ? 'low' : 'in';
    var txt = b.available === 0 ? 'All issued' : b.available + ' of ' + b.copies + ' available';
    return '<span class="stock ' + cls + '">' + txt + '</span>';
  }

  function actionBtns(b, compact) {
    var mine = myActiveIssue(b.id), html = '';
    if (mine) html += '<button class="btn sm ret" data-act="return" data-id="' + b.id + '">Return</button>';
    else if (b.available > 0) html += '<button class="btn sm primary" data-act="issue" data-id="' + b.id + '">Issue</button>';
    else html += '<button class="btn sm outline" disabled>Unavailable</button>';
    if (isFaculty) html += '<button class="btn sm danger' + (compact ? '' : ' icon') + '" data-act="delete" data-id="' + b.id + '" title="Remove book" aria-label="Remove book">Remove</button>';
    return html;
  }

  function renderCatalogue() {
    var list = filtered();
    $('resultLine').textContent = list.length + ' of ' + books.length + ' books shown';
    if (!list.length) {
      $('bookArea').innerHTML = '<div class="card empty"><b>No books found</b>Try a different search or clear the filters.</div>';
      return;
    }
    if (state.mode === 'grid') {
      $('bookArea').innerHTML = '<div class="book-grid">' + list.map(function (b) {
        return '<article class="book"><div class="cover" style="' + coverStyle(b.category) + '"><div class="ct">' + esc(b.title) + '</div><div class="ca">' + esc(b.author) + '</div></div>' +
          '<div class="meta"><span class="badge cat">' + esc(b.category) + '</span><span>' + b.year + '</span></div>' +
          '<h4>' + esc(b.title) + '</h4><div class="by">' + esc(b.author) + '</div>' +
          '<div class="meta">' + stockHtml(b) + '<span>Shelf ' + esc(b.shelf) + '</span></div>' +
          '<div class="actions">' + actionBtns(b, true) + '</div></article>';
      }).join('') + '</div>';
    } else {
      $('bookArea').innerHTML = '<div class="book-table-card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Book</th><th>Category</th><th>Year</th><th>Shelf</th><th>Availability</th><th></th></tr></thead><tbody>' +
        list.map(function (b) {
          return '<tr><td><div class="ttl">' + esc(b.title) + '</div><div class="sub">' + esc(b.author) + '</div></td><td><span class="badge cat">' + esc(b.category) + '</span></td><td>' + b.year + '</td><td>' + esc(b.shelf) + '</td><td>' + stockHtml(b) + '</td><td class="act">' + actionBtns(b, true) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
  }

  // ---- issued ----
  function renderIssues() {
    var t = state.tab;
    var rows = issues.filter(function (i) {
      if (t === 'active') return !i.returned;
      if (t === 'overdue') return !i.returned && i.overdue;
      return i.returned;
    }).sort(function (a, b) { return t === 'history' ? (b.returnedOn > a.returnedOn ? 1 : -1) : a.daysLeft - b.daysLeft; });

    var head = '<thead><tr><th>Book</th>' + (isFaculty ? '<th>Borrower</th>' : '') + '<th>Issued on</th><th>Due date</th><th>Status</th><th></th></tr></thead>';
    $('issueTable').innerHTML = head + '<tbody>' + rows.map(function (i) {
      var act = !i.returned ? '<button class="btn sm ret" data-act="return" data-id="' + i.bookId + '" data-user="' + esc(i.userId) + '">Mark returned</button>' : '';
      return '<tr><td class="ttl">' + esc(i.title) + '</td>' +
        (isFaculty ? '<td>' + esc(i.userName) + '<div class="sub">' + esc(i.userId) + '</div></td>' : '') +
        '<td>' + esc(i.issued) + '</td><td>' + esc(i.due) + '</td><td>' + statusBadge(i) + '</td><td class="act">' + act + '</td></tr>';
    }).join('') + '</tbody>';
    $('issueTable').hidden = rows.length === 0;
    var empty = $('issueEmpty');
    empty.hidden = rows.length !== 0;
    var msgs = {
      active: ['Nothing issued', isFaculty ? 'No books are with borrowers right now.' : 'Visit the catalogue to issue your first book.'],
      overdue: ['No overdue books', 'Great, everything is on time.'],
      history: ['No history yet', 'Returned books will show up here.']
    };
    empty.innerHTML = '<b>' + msgs[t][0] + '</b>' + msgs[t][1];
  }

  // ---------- events ----------
  $('nav').addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    e.preventDefault(); go(a.dataset.view);
  });
  $('burger').addEventListener('click', function () { document.body.classList.add('menu-open'); });
  $('scrim').addEventListener('click', function () { document.body.classList.remove('menu-open'); });
  $('logoutBtn').addEventListener('click', function () { doLogout(false); });

  ['q', 'fCat', 'fAvail', 'fSort'].forEach(function (id) {
    $(id).addEventListener(id === 'q' ? 'input' : 'change', renderCatalogue);
  });

  // top-bar search jumps to catalogue
  $('globalSearch').addEventListener('input', function () {
    $('q').value = this.value;
    if (state.view !== 'catalogue') go('catalogue');
    renderCatalogue();
  });
  $('q').addEventListener('input', function () { $('globalSearch').value = this.value; });

  // new-arrival click -> search for that title
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-find]');
    if (!a) return;
    e.preventDefault();
    $('q').value = a.dataset.find; $('globalSearch').value = a.dataset.find;
    go('catalogue'); renderCatalogue();
  });

  $('viewSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.mode = b.dataset.mode;
    document.querySelectorAll('#viewSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
    renderCatalogue();
  });

  $('issueTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.tab = b.dataset.tab;
    document.querySelectorAll('#issueTabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    renderIssues();
  });

  // issue / return / delete
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var id = b.dataset.id, act = b.dataset.act;
    var book = books.find(function (x) { return String(x.id) === id; });

    if (act === 'delete') {
      if (!confirm('Remove "' + (book ? book.title : 'this book') + '" from the library?')) return;
      api('api/books/delete', 'POST', { id: id }).then(function () { toast('Book removed'); load(); }).catch(function (er) { toast(er.message, true); });
      return;
    }
    b.disabled = true;
    if (act === 'issue') {
      api('api/issue', 'POST', { id: id }).then(function (d) {
        toast('Issued! Please return by ' + d.due); load();
      }).catch(function (er) { toast(er.message, true); b.disabled = false; });
    } else if (act === 'return') {
      var form = { id: id };
      if (b.dataset.user) form.user = b.dataset.user;
      api('api/return', 'POST', form).then(function () { toast('Book returned. Thank you!'); load(); })
        .catch(function (er) { toast(er.message, true); b.disabled = false; });
    }
  });

  // export CSV
  $('exportBtn').addEventListener('click', function () {
    var rows = [['ID', 'Title', 'Author', 'Category', 'Year', 'Shelf', 'Copies', 'Available']];
    filtered().forEach(function (b) { rows.push([b.id, b.title, b.author, b.category, b.year, b.shelf, b.copies, b.available]); });
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'library-books.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Exported ' + (rows.length - 1) + ' books');
  });

  // add book
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, data = {};
    ['title', 'author', 'category', 'year', 'copies', 'shelf'].forEach(function (k) { data[k] = f.elements[k].value; });
    api('api/books/add', 'POST', data).then(function () {
      toast('Book added to the library'); f.reset(); f.elements.year.value = 2024; f.elements.copies.value = 3;
      return load().then(function () { go('catalogue'); });
    }).catch(function (er) { toast(er.message, true); });
  });

  // ---------- start ----------
  if (isFaculty) document.querySelectorAll('[data-faculty]').forEach(function (a) { a.hidden = false; });
  go(location.hash.slice(1) || 'overview');
  load();
})();
