'use strict'

const search = document.querySelector('[type=search]');
const code = document.querySelector('pre');

search.addEventListener('keyup', () => {
  const xhr = new XMLHttpRequest;
  xhr.open('GET', '/search/' + search.value, true);
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      code.textContent = xhr.responseText;
    }
  };
  xhr.send();
}, false);
