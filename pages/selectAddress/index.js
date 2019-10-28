// pages/selectAddress/index.js
Page({
  data: {
    addressList: [
      { id: 0, name: '朱佳敏', address: '杭州市在那边好结果很高做空工具和几个', phone: '1321231231' },
      { id: 1, name: '朱佳敏', address: '杭州市在那边好结果很高做空工具和几个', phone: '1321231231' }
    ]
  },
  onLoad: function (options) {

  },
  onReady: function () {

  },
  onShow: function () {

  },
  onHide: function () {

  },
  onUnload: function () {

  },
  toAdd: function() {
    wx.navigateTo({
      url: '../addAddress/index',
    })
  },
  back: function(e) {
    const address = e.currentTarget.dataset.item
    var app = getApp()
    app.globalData.orderAddress = address
    wx.navigateBack()
  }
})