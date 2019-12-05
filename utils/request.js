import {
  BASE_URL,
  defaultTimeout
} from './constant.js'
var Fly = require("flyio")
var qs = require('qs');

const request = new Fly()

request.config.baseURL = BASE_URL
request.config.timeout = defaultTimeout

request.interceptors.request.use((request) => {
  request.headers['Accept'] = 'application/json,*/*'
  // const token = wx.getStorageSync('X-Token')
  // if (token) {
  //   request.headers['token'] = token
  // }
  request.headers['token'] = 'token' // test

  return request
})

request.interceptors.response.use(
  res => {
    if (res.data) {
      switch (res.data.code) {
        case 'A00002':
          return Promise.reject(res.data)
        case 'A00004':
          wx.reLaunch({
            url: '../login/index'
          })
          wx.showLoading({ title: '重新登录' })
          setTimeout(function () {
            wx.hideLoading()
          }, 1000)
          wx.clearStorageSync()
          return Promise.reject(res.data)
        default:
          break;
      }
    }
    return res.data
  },
  (err) => {
    return Promise.resolve(err)
  }
)

export default request