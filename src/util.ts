// Shamelessly stolen from: https://stackoverflow.com/a/35531844
export function OBSCURE_EMAIL(email) {
    let parts = email.split("@");
    let name = parts[0];
    let result = name.charAt(0);
    for(let i=1; i<name.length; i++) {
        result += "*";
    }
    result += name.charAt(name.length - 1);
    result += "@";
    let domain = parts[1];
    result += domain.charAt(0);
    let dot = domain.indexOf(".");
    for(let i=1; i<dot; i++) {
        result += "*";
    }
    result += domain.substring(dot);

    return result;
}

// xD
let CODEPONENTS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
                   "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
                   "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
export function GENERATE_CODE(len) {
    let code = [];
    for (let i = 0; i < len; i++) {
        let number = Math.floor(Math.random() * CODEPONENTS.length)
        code.push(CODEPONENTS[number]);
    }
    return code.join("");
}
