module.exports = getColorFromString;

function getColorFromString(player) {
    // colors from http://flatuicolors.com/
    var colors = ["#c0392b", "#27ae60", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];

    return colors[hashString(player) % colors.length];

}

function hashString(str) {
    var hash = 0, i, chr, len;
    if (str.length == 0) return hash;
    for (i = 0, len = str.length; i < len; i++) {
        chr   = str.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash;
}
