// pages/addAddress/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    item: {},
    multiIndex: [0, 0],
    multiArray: [
      ['杭州市'],
      [
        '余杭区', '萧山区', '富阳区', '桐庐县', '建德市', '淳安县', '江干区', 
        '滨江区', '上城区', '下城区', '拱墅区', '西湖区', '下沙区', '临安区'
      ],
    ],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.item) {
      this.setData({
        item: JSON.parse(options.item),
      });
    }
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

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  changePicker: function(e) {
    console.log(e.detail.value)
  },

  bindMultiPickerChange: function (e) {
    const multiArray = this.data.multiArray
    const multiIndex = e.detail.value
    this.data.item.address = `${multiArray[0][multiIndex[0]]}${multiArray[1][multiIndex[1]]}`
    this.setData({
      item: this.data.item
    })
  },
})