// components/home/index.js
Page({
  data: {
    banners: [
      '/images/banner@2x.png',
      '/images/banner@2x.png'
    ],
    aciveType: 'water',
    activeText: 'all',
    goodList: [
      { id: 1, name: '商品名称1', src: '/images/banner@2x.png'},
      { id: 2, name: '商品名称2', src: '/images/banner@2x.png' },
      { id: 3, name: '商品名称3', src: '/images/banner@2x.png' },
      { id: 4, name: '商品名称4', src: '/images/banner@2x.png' },
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
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  changeType: function(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      aciveType: type
    })
  },
  changTextType: function(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      activeText: type
    })
  }

})