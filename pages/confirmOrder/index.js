// pages/confirmOrder/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    first: false,
    status: null, // 0: 待支付 1: 已取消
    active: true,
    totalPrice: 199,
    goodsList: [
      { id: 1, name: '商品名称1', num: 1, price: 199.00, active: true },
      { id: 2, name: '商品名称2', num: 2, price: 199.00, active: true },
      { id: 3, name: '商品名称3', num: 2, price: 199.00, active: true }
    ],
    isShowDialog: false,
    address: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      first: options.first
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },
  changeRadio: function() {
    this.setData({
      active: !this.data.active
    })
  },
  toPay: function() {
    const adress = this.data.address
    if (JSON.stringify(adress) == "{}") {
      this.setData({
        isShowDialog: true
      })
    }
  },
  hideDialog: function() {
    this.setData({
      isShowDialog: false
    })
  }
})