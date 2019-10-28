//app.js
import {
  showToast
} from './utils/util.js'
import api from './api/api.js'

App({
  onLaunch: function () {
    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          api.authorizedLogin({
            code: res.code
          }).then(result => {
            if (result.code === 'A00000') {
              this.globalData.oppenId = result.data
            } else {
              showToast(result.msg)
            }
          })
        } else {
          console.log('登录失败！' + res.errMsg)
        }
      }
    })
  },
  globalData: {
    userInfo: null,
    oppenId: '',
    orderAddress: {}
  }
})