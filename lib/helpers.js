exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};


exports.rename = function(value) {
    return value.replace('IEC62196Type2', '');
}