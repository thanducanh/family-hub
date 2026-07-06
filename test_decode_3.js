const utf8 = require('utf8');

const test1 = "ThÃ¢n Äá»©c Anh";
const test2 = "LÃª Thá»‹ Kiá»u Trang";
const test3 = "KhÃ¡c";
const test4 = "HoÃ n tiá»n %";

// Some mojibake might come from win1252 or utf8 npm package
function decodeMojibake1(str) {
  try {
    return Buffer.from(str, 'binary').toString('utf8');
  } catch(e) { return str; }
}

function decodeMojibake2(str) {
  try {
    return utf8.decode(str);
  } catch(e) { return str; }
}


console.log("binary:", decodeMojibake1(test1));
console.log("binary:", decodeMojibake1(test2));
console.log("binary:", decodeMojibake1(test3));
console.log("binary:", decodeMojibake1(test4));
