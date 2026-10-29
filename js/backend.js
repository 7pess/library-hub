/* =====================================================================
   LibraryHub - backend switch
   ---------------------------------------------------------------------
   The website talks to "api/..." addresses.
   * If the C++ server (server.cpp) is running, the real server answers.
   * If the site is opened from free static hosting (GitHub Pages, Netlify,
     etc.) there is no C++ server, so this file answers instead and keeps
     the data in the visitor's own browser (localStorage).
   Same pages, same rules, same sample data in both modes.
   ===================================================================== */
(function () {
  'use strict';

  var nativeFetch = window.fetch.bind(window);
  var probe = null;

  // Is the real C++ server there? (asked once)
  function isRealServer() {
    if (!probe) {
      probe = nativeFetch('api/ping', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { return !!(d && d.mode === 'cpp'); })
        .catch(function () { return false; });
    }
    return probe;
  }

  window.fetch = function (url, opts) {
    var u = String(url).replace(/^\//, '');
    if (u.indexOf('api/') !== 0) return nativeFetch(url, opts);
    return isRealServer().then(function (real) {
      return real ? nativeFetch(url, opts) : mock(u, opts || {});
    });
  };

  window.LH_resetDemoData = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    db = null;
  };

  // -------------------------------------------------------------------
  //  Browser-only version of the server (mirrors server.cpp)
  // -------------------------------------------------------------------
  var KEY = 'lh_demo_db_v1', DAY = 86400000, LOAN_DAYS = 14, FACULTY_DAYS = 30, MAX_STUDENT = 3;
  var db = null;

  var USERS = [
    { id: 'EN25378616', password: 'pass123',    name: 'Demo Student',          role: 'student', dept: 'Computer Engineering' },
    { id: 'EN25378617', password: 'pass123',    name: 'Aarav Kulkarni',        role: 'student', dept: 'Information Technology' },
    { id: 'EN25378618', password: 'pass123',    name: 'Sneha Deshmukh',        role: 'student', dept: 'Mechanical Engineering' },
    { id: 'EN25378619', password: 'pass123',    name: 'Rohan Jadhav',          role: 'student', dept: 'Computer Engineering' },
    { id: 'FAC1001',    password: 'faculty123', name: 'Prof. Meera Kulkarni',  role: 'faculty', dept: 'Library In-charge' }
  ];

  function findUser(id) { return USERS.find(function (u) { return u.id === id; }) || null; }

  function seed() {
    var now = Date.now();
    var B = [
      [1, 'Let Us C', 'Yashavant Kanetkar', 'Programming', 2019, 6, 'CS-A1'],
      [2, 'The C++ Programming Language', 'Bjarne Stroustrup', 'Programming', 2013, 4, 'CS-A1'],
      [3, 'Introduction to Algorithms', 'Thomas H. Cormen', 'Computer Science', 2022, 5, 'CS-A2'],
      [4, 'Database System Concepts', 'Abraham Silberschatz', 'Computer Science', 2019, 4, 'CS-A2'],
      [5, 'Operating System Concepts', 'Abraham Silberschatz', 'Computer Science', 2018, 5, 'CS-A3'],
      [6, 'Computer Networks', 'Andrew S. Tanenbaum', 'Computer Science', 2021, 3, 'CS-A3'],
      [7, 'Artificial Intelligence: A Modern Approach', 'Stuart Russell', 'Computer Science', 2020, 3, 'CS-A4'],
      [8, 'Clean Code', 'Robert C. Martin', 'Programming', 2008, 4, 'CS-B1'],
      [9, 'The Pragmatic Programmer', 'Andrew Hunt', 'Programming', 2019, 3, 'CS-B1'],
      [10, 'Python Crash Course', 'Eric Matthes', 'Programming', 2023, 5, 'CS-B2'],
      [11, 'Higher Engineering Mathematics', 'B. S. Grewal', 'Mathematics', 2017, 8, 'MT-C1'],
      [12, 'Discrete Mathematics and Its Applications', 'Kenneth H. Rosen', 'Mathematics', 2018, 4, 'MT-C2'],
      [13, 'Digital Design', 'M. Morris Mano', 'Electronics', 2012, 4, 'EL-D1'],
      [14, 'Engineering Mechanics', 'R. K. Bansal', 'Mechanical', 2015, 5, 'ME-E1'],
      [15, 'Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography', 1999, 6, 'GN-F1'],
      [16, 'The Alchemist', 'Paulo Coelho', 'Fiction', 1988, 4, 'GN-F2'],
      [17, 'Atomic Habits', 'James Clear', 'Self Help', 2018, 5, 'GN-G1'],
      [18, 'Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'Self Help', 1997, 3, 'GN-G1']
    ];
    var s = { books: [], issues: [], sessions: {} };
    B.forEach(function (b) {
      s.books.push({ id: b[0], title: b[1], author: b[2], category: b[3], year: b[4], copies: b[5], available: b[5], shelf: b[6] });
    });
    function add(bookId, uid, daysAgo) {
      var u = findUser(uid), b = s.books.find(function (x) { return x.id === bookId; });
      s.issues.push({ bookId: bookId, userId: uid, userName: u.name, issued: now - daysAgo * DAY, due: now - daysAgo * DAY + LOAN_DAYS * DAY, returned: false, returnedOn: 0 });
      b.available--;
    }
    add(2, 'EN25378616', 5);
    add(10, 'EN25378616', 11);
    add(3, 'EN25378617', 18);   // overdue
    add(7, 'EN25378618', 2);
    add(11, 'EN25378619', 16);  // overdue
    add(15, 'EN25378617', 7);
    s.issues.push({ bookId: 1, userId: 'EN25378616', userName: 'Demo Student', issued: now - 40 * DAY, due: now - 26 * DAY, returned: true, returnedOn: now - 30 * DAY });
    return s;
  }

  function load() {
    if (db) return db;
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.books && s.issues) { db = s; if (!db.sessions) db.sessions = {}; return db; }
    } catch (e) {}
    db = seed();
    save();
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  function fmtDate(t) {
    var d = new Date(t), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function clean(s) { return String(s || '').replace(/[|\r\n]/g, ' ').trim(); }
  function makeToken() {
    var h = '0123456789abcdef', t = '';
    for (var i = 0; i < 32; i++) t += h[Math.floor(Math.random() * 16)];
    return t;
  }
  function bookById(id) { return db.books.find(function (b) { return b.id === id; }) || null; }
  function activeCount(uid) { return db.issues.filter(function (i) { return i.userId === uid && !i.returned; }).length; }

  function issueJson(i) {
    var b = bookById(i.bookId), now = Date.now();
    return {
      bookId: i.bookId, title: b ? b.title : '(deleted book)', userId: i.userId, userName: i.userName,
      issued: fmtDate(i.issued), due: fmtDate(i.due), returned: i.returned,
      returnedOn: i.returned ? fmtDate(i.returnedOn) : '',
      overdue: !i.returned && now > i.due, daysLeft: Math.trunc((i.due - now) / DAY)
    };
  }

  function resp(status, obj) {
    return new Response(JSON.stringify(obj), { status: status, headers: { 'Content-Type': 'application/json' } });
  }
  function err(status, msg) { return [status, { ok: false, error: msg }]; }

  function mock(path, opts) {
    var method = (opts.method || 'GET').toUpperCase();
    var form = new URLSearchParams(typeof opts.body === 'string' ? opts.body : '');
    var headers = opts.headers || {};
    load();
    var out;
    try { out = route(path, method, form, headers['X-Token'] || ''); }
    catch (e) { out = err(500, 'Something went wrong.'); }
    return Promise.resolve(resp(out[0], out[1]));
  }

  function route(path, method, f, tok) {
    var now = Date.now(), i, b;

    if (path === 'api/login' && method === 'POST') {
      var id = (f.get('id') || '').toUpperCase(), pw = f.get('password') || '', role = f.get('role') || '';
      var u = findUser(id);
      if (!u || u.password !== pw || u.role !== role)
        return err(401, role === 'faculty' ? 'Wrong faculty ID or password.' : 'Wrong PRN or password.');
      var t = makeToken(); db.sessions[t] = u.id; save();
      return [200, { ok: true, token: t, id: u.id, name: u.name, role: u.role, dept: u.dept }];
    }

    var me = db.sessions[tok] ? findUser(db.sessions[tok]) : null;
    if (!me) return err(401, 'Please log in first.');

    if (path === 'api/logout' && method === 'POST') { delete db.sessions[tok]; save(); return [200, { ok: true }]; }
    if (path === 'api/me') return [200, { ok: true, id: me.id, name: me.name, role: me.role, dept: me.dept }];
    if (path === 'api/books' && method === 'GET') return [200, db.books];

    if (path === 'api/issues' && method === 'GET')
      return [200, db.issues.filter(function (x) { return me.role !== 'student' || x.userId === me.id; }).map(issueJson)];

    if (path === 'api/issue' && method === 'POST') {
      b = bookById(parseInt(f.get('id'), 10));
      if (!b) return err(400, 'Book not found.');
      if (b.available <= 0) return err(400, 'No copies available right now.');
      if (db.issues.some(function (x) { return x.bookId === b.id && x.userId === me.id && !x.returned; })) return err(400, 'You already have this book.');
      if (me.role === 'student' && activeCount(me.id) >= MAX_STUDENT) return err(400, 'Limit reached: students can hold ' + MAX_STUDENT + ' books at a time.');
      var days = me.role === 'faculty' ? FACULTY_DAYS : LOAN_DAYS;
      db.issues.push({ bookId: b.id, userId: me.id, userName: me.name, issued: now, due: now + days * DAY, returned: false, returnedOn: 0 });
      b.available--; save();
      return [200, { ok: true, due: fmtDate(now + days * DAY) }];
    }

    if (path === 'api/return' && method === 'POST') {
      var bid = parseInt(f.get('id'), 10);
      var who = f.get('user') && me.role === 'faculty' ? f.get('user') : me.id;
      for (i = 0; i < db.issues.length; i++) {
        var x = db.issues[i];
        if (x.bookId === bid && x.userId === who && !x.returned) {
          x.returned = true; x.returnedOn = now;
          b = bookById(bid); if (b && b.available < b.copies) b.available++;
          save();
          return [200, { ok: true }];
        }
      }
      return err(400, 'No active issue found for this book.');
    }

    if (path === 'api/books/add' && method === 'POST') {
      if (me.role !== 'faculty') return err(403, 'Only faculty can add books.');
      var title = clean(f.get('title')), author = clean(f.get('author')), copies = parseInt(f.get('copies'), 10) || 0;
      if (!title || !author || copies < 1 || copies > 100) return err(400, 'Please fill title, author and copies (1-100).');
      var maxId = 0; db.books.forEach(function (k) { maxId = Math.max(maxId, k.id); });
      var cat = clean(f.get('category')), shelf = clean(f.get('shelf'));
      var nb = { id: maxId + 1, title: title, author: author, category: cat || 'General', year: parseInt(f.get('year'), 10) || 0, copies: copies, available: copies, shelf: shelf || 'NEW-1' };
      db.books.push(nb); save();
      return [200, { ok: true, book: nb }];
    }

    if (path === 'api/books/delete' && method === 'POST') {
      if (me.role !== 'faculty') return err(403, 'Only faculty can remove books.');
      var did = parseInt(f.get('id'), 10);
      b = bookById(did);
      if (!b) return err(400, 'Book not found.');
      if (b.available !== b.copies) return err(400, 'Some copies are issued. Return them first.');
      db.books = db.books.filter(function (k) { return k.id !== did; }); save();
      return [200, { ok: true }];
    }

    return err(404, 'Unknown API route.');
  }
})();
