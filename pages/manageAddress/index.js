// pages/manageAddress/index.js
Page({
  data: {
    showConfirm: false,
    addressList: [
      { id: 1, name: '朱佳敏', address: '杭州市滨江区' },
      { id: 2, name: '朱佳敏', address: '杭州市余杭区' },
    ]
  },
  onShow: function () {

  },
  onHide: function () {

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