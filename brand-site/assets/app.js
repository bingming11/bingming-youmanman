/* 邮满满品牌官网 —— 交互逻辑 */
(function () {
  'use strict';

  var I18N = window.I18N || {};
  var DEFAULT_LANG = 'zh';

  // 深度获取嵌套 key（支持 "nav.home"）
  function getText(obj, key) {
    var parts = key.split('.');
    var val = obj;
    for (var i = 0; i < parts.length; i++) {
      if (val == null) return undefined;
      val = val[parts[i]];
    }
    return val;
  }

  function setLang(lang) {
    if (!I18N[lang]) lang = DEFAULT_LANG;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'ko' ? 'ko-KR' : 'en';

    var dict = I18N[lang];

    // 更新所有带 data-i18n 的元素
    var nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var text = getText(dict, key);
      if (text !== undefined) {
        if (el.tagName === 'TITLE' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.textContent = text;
        } else {
          // 保留 HTML 中的 <br> 标签
          el.innerHTML = text.replace(/\n/g, '<br>');
        }
      }
    });

    // 更新 <title>
    var titleKey = document.querySelector('title[data-i18n-key]');
    if (titleKey) {
      var t = getText(dict, titleKey.getAttribute('data-i18n-key'));
      if (t) document.title = t;
    }

    // 更新 <meta name="description">
    var metaDesc = document.querySelector('meta[name="description"][data-i18n-key]');
    if (metaDesc) {
      var d = getText(dict, metaDesc.getAttribute('data-i18n-key'));
      if (d) metaDesc.setAttribute('content', d);
    }

    // 更新语言按钮状态
    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // 持久化
    try {
      localStorage.setItem('ym_lang', lang);
    } catch (e) {}

    // 触发自定义事件，供其他组件监听
    window.dispatchEvent(new CustomEvent('ym:langchange', { detail: { lang: lang } }));
  }

  // 初始化语言：URL 参数 > localStorage > 浏览器语言 > 默认中文
  function initLang() {
    var urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && I18N[urlLang]) {
      setLang(urlLang);
    } else {
      var saved;
      try {
        saved = localStorage.getItem('ym_lang');
      } catch (e) {}
      var browser = navigator.language || navigator.userLanguage || '';
      if (!saved) {
        if (browser.indexOf('ko') === 0) saved = 'ko';
        else if (browser.indexOf('en') === 0) saved = 'en';
      }
      setLang(saved || DEFAULT_LANG);
    }

    document.querySelectorAll('.lang-switch button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-lang'));
      });
    });
  }

  // 移动端菜单
  function initMobileMenu() {
    var toggle = document.getElementById('menuToggle');
    var nav = document.getElementById('mainNav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('open', !expanded);
      document.body.style.overflow = !expanded ? 'hidden' : '';
    });

    // 点击导航链接后自动收起
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // 滚动时 header 阴影
  function initHeaderScroll() {
    var header = document.getElementById('header');
    if (!header) return;
    function update() {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // 复制联系方式
  function initCopyPhone() {
    var btn = document.getElementById('copyPhone');
    var phoneEl = document.getElementById('phoneNumber');
    if (!btn || !phoneEl) return;

    btn.addEventListener('click', function () {
      var phone = phoneEl.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phone).then(showCopied).catch(copyFallback);
      } else {
        copyFallback();
      }

      function copyFallback() {
        var ta = document.createElement('textarea');
        ta.value = phone;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          showCopied();
        } catch (e) {
          alert(phone);
        }
        document.body.removeChild(ta);
      }

      function showCopied() {
        var original = btn.textContent;
        var savedLang;
        try { savedLang = localStorage.getItem('ym_lang'); } catch (e) {}
        btn.textContent = savedLang === 'en' ? 'Copied!' : savedLang === 'ko' ? '복사 완료!' : '已复制';
        setTimeout(function () {
          setLang(savedLang || DEFAULT_LANG);
        }, 1600);
      }
    });
  }

  // 滚动显现动画
  function initReveal() {
    var revealElements = document.querySelectorAll('.section-head, .service-card, .advantage-card, .process-step, .hero-content, .hero-visual');
    revealElements.forEach(function (el) {
      el.classList.add('reveal');
    });

    var observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealElements.forEach(function (el) { observer.observe(el); });
    } else {
      revealElements.forEach(function (el) { el.classList.add('visible'); });
    }
  }

  // 初始化
  document.addEventListener('DOMContentLoaded', function () {
    initLang();
    initMobileMenu();
    initHeaderScroll();
    initCopyPhone();
    initReveal();
  });
})();
