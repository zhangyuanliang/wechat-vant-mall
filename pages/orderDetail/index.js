// pages/orderDetail/index.js
var app = getApp()

Page({
  data: {
    status: 0, // 0: 待支付 1: 已取消
    // active: true, // 选择微信支付
    totalPrice: 199,
    goodsList: [
      { id: 1, name: '商品名称1', num: 1, price: 199.00, active: true, src: '/images/home/good-1.png' },
      { id: 2, name: '商品名称2', num: 2, price: 199.00, active: true, src: '/images/home/good-2.png' },
      { id: 3, name: '商品名称3', num: 2, price: 199.00, active: true, src: '/images/home/good-1.png' }
    ],
    isShowDialog: false,
    address: {}
  },
  onLoad: function (options) {
    
  },
  onReady: function () {

  },
  onShow: function () {
    this.setData({
      address: app.globalData.orderAddress
    })
  },
  onHide: function () {

  },
  onUnload: function () {

  },
  changeRadio: function () {
    this.setData({
      active: !this.data.active
    })
  },
  wxPay: function () {
    // wx.requestPayment({
    //   timeStamp: '',
    //   nonceStr: '',
    //   package: '',
    //   signType: 'MD5',
    //   paySign: '',
    //   success(res) { },
    //   fail(res) { }
    // })
  },
  toPay: function () {
    const adress = this.data.address
    if (JSON.stringify(adress) == "{}") {
      this.setData({
        isShowDialog: true
      })
    } else {
      this.wxPay()
    }
  },
  hideDialog: function () {
    this.setData({
      isShowDialog: false
    })
  },
  toSelectAddress: function () {
    wx.navigateTo({
      url: '../selectAddress/index',
    })
  }
})