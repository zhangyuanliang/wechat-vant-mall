// pages/login/index.js
import {
  vailPhone,
  debounce,
  showToast
} from '../../utils/util.js'
import { USER_INFO } from '../../utils/constant.js'
import api from '../../api/api.js'
const app = getApp()

Page({
  data: {
    phone: '13235810180',
    code: '123',
    disabled: true
  },
  onLoad: function (options) {

  },
  onShow: function () {

  },
  onHide: function () {

  },
  onUnload: function () {

  },
  toLogin: function() {
    let result = this.validate()
    if (result.success) {
      const { phone, code } = this.data
      if (phone === '13235810180' && code === '123') { // 测试数据
        wx.redirectTo({
          url: '../main/index?activeIndex=0',
        })
      }
      /**
      let param = {
        userPhone: phone,
        code,
        openId: app.globalData.oppenId
      }
      wx.showLoading({ title: '稍等', mask: true })
      api.login(param).then(res => {debugger
        let d = res.data
        if (res.code === 'A00000') {
          wx.hideLoading()
          wx.setStorageSync('X-Token', res.data.token)
          wx.setStorageSync(USER_INFO, res.data)
          wx.redirectTo({
            url: '../main/index?activeIndex=0'
          })
        } else {
          wx.hideLoading()
          showToast(res.msg)
        }
      })
      .catch(res => {
        wx.hideLoading()
        showToast(res.msg)
      }) */
    } else {
      showToast(result.msg)
    }
  },
  getSmsCodeByPhone: function () {
    let param = {
      phone: this.data.phone
    }
    api.sendCode(param).then(res => {
      console.log(res)
    })
  },
  changeInput: function (e) {
    let type = e.target.dataset.type
    let val = e.detail.value
    switch (type) {
      case 'phone':
        this.setData({ phone: val })
        let isPhone = vailPhone(this.data.phone)
        if (isPhone) {
          this.setData({ disabled: false })
        } else {
          this.setData({ disabled: true })
        }
        break
      case 'code':
        this.setData({ code: val })
        break
    }
  },
  validate: function () {
    let result = {
      success: true,
      msg: ''
    }
    const { phone, code } = this.data
    if (!phone.trim()) {
      result.success = false
      result.msg = '手机号不为空'
      return result
    }
    let isPhone = vailPhone(phone)
    if (!isPhone) {
      result.success = false
      result.msg = '手机号不正确'
      return result
    } else {
      if (!code) {
        result.success = false
        result.msg = '验证码不正确'
        return result
      }
    }
    return result
  },


})