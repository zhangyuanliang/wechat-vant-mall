// components/shoppingCart/index.js
Page({
  data: {
    goodsList: [
      { id: 1, name: '商品名称1', num: 1, price: '199.00', active: true, src: '/images/home/good-1.png'},
      { id: 2, name: '商品名称2', num: 2, price: '199.00', active: false, src: '/images/home/good-2.png'}
    ],
    activeAll: true,
    totalPrice: 0,
    selectedNum: 0,
  },
  onLoad: function (options) {
    
  },
  onReady: function () {
    
  },
  onShow: function () {
    this.calculateSelectedGoods()
    this.calculatePrice()
  },
  onHide: function () {

  },

  hasNoSelected: function() {
    return this.data.goodsList.find(it => {
      return !it.active
    })
  },

  calculateSelectedGoods: function() {
    const selectedArr = this.data.goodsList.map(it => {
      return it.active
    })
    debugger
    this.setData({
      selectedNum: selectedArr.length
    })
  },

  calculatePrice: function() {
    let total = 0;
    this.data.goodsList.forEach(it => {
      if (it.active) {
        total = + it.price
      }
    })
    this.setData({
      totalPrice: total
    })
  },

  changeSelect: function(e) {
    const index = e.detail
    let goodItem = this.data.goodsList[index]
    goodItem.active = !goodItem.active
    if (this.hasNoSelected()) {
      this.setData({
        goodsList: this.data.goodsList,
        activeAll: false,
      })
    } else {
      this.setData({
        goodsList: this.data.goodsList,
        activeAll: true,
      })
    }
    this.calculateSelectedGoods()
    this.calculatePrice()
  },
  toDelete: function(e) {
    const goodsList = this.data.goodsList
    goodsList.splice(e.detail, 1)
    this.setData({
      goodsList: goodsList
    })
  },
  changeNum: function(e) {
    const index = e.detail.index
    const operation = e.detail.operation
    let goodItem = this.data.goodsList[index]
    if (operation === 'up') {
      goodItem.num = ++goodItem.num
    } else {
      goodItem.num = --goodItem.num
    }
    this.setData({
      goodsList: this.data.goodsList
    })
  },
  changeSelectAll() {
    const activeAll = this.data.activeAll
    const goodsList = this.data.goodsList.map(item => {
      item.active = !activeAll
      return item
    })
    this.setData({
      activeAll: !activeAll,
      goodsList
    })
  }
})