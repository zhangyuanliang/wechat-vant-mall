// pages/manageAddress/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    showConfirm: false,
    addressList: [
      { id: 1, name: '朱佳敏', address: '杭州市滨江区' },
      { id: 2, name: '朱佳敏', address: '杭州市余杭区' },
    ]
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
  toDelete: function(e) {
    this.delIndex = e.detail
    this.setData({
      showConfirm: true
    })
  },
  confirmDelete: function() {
    const addressList = this.data.addressList
    addressList.splice(this.delIndex, 1)
    this.setData({
      addressList: addressList,
      showConfirm: false
    })
  },
  cancel: function () {
    this.setData({
      showConfirm: false
    })
  },
  toEdit: function(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: '../addAddress/index?item=' + JSON.stringify(item),
    })
  }
})