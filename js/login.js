/* LibraryHub - login page logic */
(function () {
  'use strict';

  // already signed in? go straight to the dashboard
  try {
    if (localStorage.getItem('lh_token') || sessionStorage.getItem('lh_token')) {
      location.replace('dashboard.html');
      return;
    }
  } catch (e) {}

  var role = 'student';
  var $ = function (id) { return document.getElementById(id); };
  var idInput = $('userId'), pwInput = $('password'), errBox = $('errorBox'), btn = $('submitBtn');

  function toast(msg, bad) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, 1800);
  }

  function setRole(r) {
    role = r;
    document.querySelectorAll('#roleSwitch button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.role === r);
    });
    $('idLabel').textContent = r === 'student' ? 'PRN Number' : 'Faculty ID';
    idInput.placeholder = r === 'student' ? 'e.g. EN25378616' : 'e.g. FAC1001';
    btn.textContent = 'Sign in as ' + (r === 'student' ? 'Student' : 'Faculty');
    errBox.hidden = true;
  }

  document.querySelectorAll('#roleSwitch button').forEach(function (b) {
    b.addEventListener('click', function () { setRole(b.dataset.role); });
  });

  // show / hide password
  $('togglePw').addEventListener('click', function () {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
  });

  // copy buttons
  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy', true); }
      document.body.removeChild(ta);
    }
  }
  document.querySelectorAll('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      copyText(b.dataset.copy, function () {
        b.classList.add('done');
        toast('Copied: ' + b.dataset.copy);
        setTimeout(function () { b.classList.remove('done'); }, 1200);
      });
    });
  });

  // "Use" button fills the form
  document.querySelectorAll('.use').forEach(function (b) {
    b.addEventListener('click', function () {
      setRole(b.dataset.role);
      idInput.value = b.dataset.id;
      pwInput.value = b.dataset.pw;
      toast('Demo details filled in');
    });
  });

  // submit
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = idInput.value.trim(), pw = pwInput.value;
    if (!id || !pw) {
      errBox.textContent = 'Please enter your ' + (role === 'student' ? 'PRN' : 'Faculty ID') + ' and password.';
      errBox.hidden = false;
      return;
    }
    errBox.hidden = true;
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = 'Signing in...';

    fetch('api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'role=' + encodeURIComponent(role) + '&id=' + encodeURIComponent(id) + '&password=' + encodeURIComponent(pw)
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || 'Login failed');
        var store = $('remember').checked ? localStorage : sessionStorage;
        store.setItem('lh_token', d.token);
        store.setItem('lh_user', JSON.stringify({ id: d.id, name: d.name, role: d.role, dept: d.dept }));
        location.href = 'dashboard.html';
      })
      .catch(function (err) {
        errBox.textContent = err.message === 'Failed to fetch' ? 'Cannot reach the server. Is library.exe running?' : err.message;
        errBox.hidden = false;
        btn.disabled = false;
        btn.textContent = old;
      });
  });
})();
