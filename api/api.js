import request from '../utils/request.js';
var qs = require('qs');

export default {
  // 登录
  login(data) {
    return request.post('/api/user/uc/userInfo/api/loginUser', data)
  },
  // 获取appId
  authorizedLogin(data) {
    return request.post('/api/user/uc/userInfo/api/authorizedLogin', qs.stringify(data))
  },
  // 获取验证码
  sendCode(data) {
    return request.post('/api/user/uc/userInfo/api/verificationCode', qs.stringify(data))
  },
  // 获取订单数量
  orderCount(data) {
    return request.post('/api/agency/order/orderInfo/api/orderInfoOrderCount', qs.stringify(data))
  },
}