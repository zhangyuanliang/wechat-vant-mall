// pages/confirmOrder/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    active: true,
    totalPrice: 199,
    goodsList: [
      { id: 1, name: '商品名称1', num: 1, price: 199.00, active: true },
      { id: 2, name: '商品名称2', num: 2, price: 199.00, active: true },
      { id: 3, name: '商品名称3', num: 2, price: 199.00, active: true }
    ],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {

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
  }
})