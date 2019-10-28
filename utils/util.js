
// 验证是否是手机号码
export function vailPhone(number) {
  let flag = true
  let myreg = /^(((13[0-9]{1})|(14[0-9]{1})|(17[0-9]{1})|(15[0-3]{1})|(15[5-9]{1})|(18[0-9]{1}))+\d{8})$/
  if (number.length !== 11 || !myreg.test(number)) {
    flag = false
  }
  return flag
}

// 节流函数 防止重复点击
export function debounce(fn, wait) {
  var timer = null;
  return function () {
    var context = this
    var args = arguments
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(function () {
      fn.apply(context, args)
    }, wait)
  }
}

export function showToast(msg) {
  wx.showToast({
    title: msg,
    icon: 'none',
    duration: 2000
  })
}

