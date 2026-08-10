 function diffUpdateGutter(textarea, gutter) {
    const lines = textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += i + '<br>';
    gutter.innerHTML = html;
  }
