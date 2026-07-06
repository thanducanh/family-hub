const test1 = "ThÃ¢n Äá»©c Anh";
const test2 = "LÃª Thá»‹ Kiá»u Trang";
const test3 = "KhÃ¡c";
const test4 = "HoÃ n tiá»n %";

function decodeMojibake(str) {
  try {
    return Buffer.from(str, 'binary').toString('utf8');
  } catch(e) { return str; }
}

console.log("1:", decodeMojibake(test1));
console.log("2:", decodeMojibake(test2));
console.log("3:", decodeMojibake(test3));
console.log("4:", decodeMojibake(test4));
