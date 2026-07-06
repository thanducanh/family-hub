const test1 = 'ThÃ¢n Ä\x90á»\x9Bc Anh';
const test2 = 'LÃª Thá»\x8B Kiá»\x81u Trang';
const test3 = 'KhÃ¡c';
const test4 = 'HoÃ n tiá»\x81n %';

function decodeMojibake(str) {
  try {
    return Buffer.from(str, 'binary').toString('utf8');
  } catch (e) {
    return str;
  }
}

console.log(decodeMojibake(test1));
console.log(decodeMojibake(test2));
console.log(decodeMojibake(test3));
console.log(decodeMojibake(test4));
