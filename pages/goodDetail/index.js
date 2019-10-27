// pages/goodDetail/index.js
Page({
  data: {
    images: [
      '/images/banner@2x.png',
      '/images/banner@2x.png'
    ],
    num: 8,
    isShowPopup: true,
    activeIndex: 1,
    goodItem: { 
      id: 1, 
      name: '商品名称1', 
      num: 1, 
      price: 199.00, 
      active: true,
      styles: [
        { id: 1, name: '保温管'},
        { id: 2, name: '双活接球阀' },
        { id: 3, name: '保温管' },
        { id: 4, name: '保温管' },
        { id: 5, name: '保温管' },
      ]
    }
  },
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
  addShop: function() {
    this.setData({
      num: ++this.data.num
    })
  },
  toShop: function() {
    wx.navigateTo({
      url: '../main/index?activeIndex=1',
    })
  },
  showPopup: function() {
    this.setData({
      isShowPopup: true
    })
  },
  closePopup: function() {
    this.setData({
      isShowPopup: false
    })
  },
  changStyle: function(e) {
    const activeIndex = e.currentTarget.dataset.index
    this.setData({
      activeIndex
    })
  },
  changeStepper(e) {
    const operation = e.currentTarget.dataset.operation
    let num = this.data.num
    if (num <= 1 && operation === 'down') return
    if (operation === 'up') {
      num = ++num
    } else {
      num = --num
    }
    this.setData({
      num
    })
  },
})