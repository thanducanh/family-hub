const test1 = "ThÃ¢n Äá»©c Anh";
const test2 = "LÃª Thá»\x8b Kiá»u Trang"; // wait, 'x8b' would be '‹' ? I'll just copy exactly from user prompt: "LÃª Thá»‹ Kiá»u Trang"
const test3 = "KhÃ¡c";
const test4 = "HoÃ n tiá»n %";

function decodeMojibake(str) {
  try {
    return Buffer.from(str, 'binary').toString('utf8');
  } catch (e) {
    return str;
  }
}

console.log(decodeMojibake("ThÃ¢n Ä\x90á»©c Anh"));
console.log(decodeMojibake("LÃª Thá»\x8b Kiá»\x81u Trang"));
console.log(decodeMojibake(test3));
console.log(decodeMojibake(test4));
