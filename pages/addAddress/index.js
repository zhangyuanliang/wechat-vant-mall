// pages/addAddress/index.js
Page({
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

  onLoad: function (options) {
    if (options.item) {
      this.setData({
        item: JSON.parse(options.item),
      });
    }
  },

  onShow: function () {

  },

  onHide: function () {

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