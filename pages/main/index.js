const app = getApp()
Page({
  data: {
    // 购物车
    goodsList: [
      { id: 1, name: '商品名称1', num: 1, price: 199.00, active: true },
      { id: 2, name: '商品名称2', num: 2, price: 199.00, active: true }
    ],
    activeAll: true,
    totalPrice: 0,
    selectedNum: 0,
    showConfirm: false,
    isEditing: false,
    login: true,
    // 底部tabbar
    tabbar: [
      {
        name: "首页",
        tips: '',
        selected: true,
        icon: {
          normal: '/images/tabbar/home.png',
          active: '/images/tabbar/home-active.png'
        }
      },
      {
        name: "购物车",
        tips: '12',
        selected: false,
        icon: {
          normal: '/images/tabbar/cart.png',
          active: '/images/tabbar/cart-active.png'
        }
      },
      {
        name: "我的",
        tips: '',
        selected: false,
        icon: {
          normal: '/images/tabbar/mine.png',
          active: '/images/tabbar/mine-active.png'
        }
      },
    ],
    tabbarHeight: app.isIPhoneX ? 84 : 50, // 底部tabbar高度
    activeIndex: 2,  // 选中的tab
    scrollTopArray: [], // 记录每个页面的滚动位置
  },
  onLoad: function (options) {
    if (options.activeIndex) {
      this.setData({
        activeIndex: parseInt(options.activeIndex)
      })
    }
    this.data.tabbar.forEach((item, index, arr) => {
      this.data.scrollTopArray[index] = 0;
      // item.isFirstLoad = true
    });
    wx.setNavigationBarTitle({
      title: this.data.tabbar[0].name,
    })
  },
  onShow: function () {
    this.updateSubPageShowHide(this.data.activeIndex);
    this.calculateSelectedGoods()
    this.calculatePrice()
  },
  onHide: function () {

  },
  /** 购物车 start */
  hasNoSelected: function () {
    return this.data.goodsList.find(it => {
      return !it.active
    })
  },

  calculateSelectedGoods: function () {
    const selectedArr = this.data.goodsList.filter(it => {
      return it.active
    })
    this.setData({
      selectedNum: selectedArr.length
    })
  },

  calculatePrice: function () {
    let total = 0;
    this.data.goodsList.forEach(it => {
      if (it.active) {
        total += it.price * it.num
      }
    })
    this.setData({
      totalPrice: total
    })
  },

  changeSelect: function (e) {
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

  confirmDelete: function() {
    const goodsList = this.data.goodsList
    goodsList.splice(this.delIndex, 1)
    this.setData({
      goodsList: goodsList,
      showConfirm: false
    })
    this.calculateSelectedGoods()
    this.calculatePrice()
  },

  toDelete: function (e) {
    this.delIndex = e.detail
    this.setData({
      showConfirm: true
    })
  },

  cancel: function() {
    this.setData({
      showConfirm: false
    })
  },

  changeNum: function (e) {
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
    this.calculateSelectedGoods()
    this.calculatePrice()
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
    this.calculateSelectedGoods()
    this.calculatePrice()
  },

  changeIsEditing: function(e) {
    const operation = e.currentTarget.dataset.operation
    this.setData({
      isEditing: operation === 'complete' ? false : true
    })
  },

  filterSelected: function() {
    return this.data.goodsList.filter(it => {
      return it.active
    })
  },
  
  toConfirmOrder: function() {
    const goodsList = this.filterSelected()
    wx.navigateTo({
      url: '../confirmOrder/index?first=true&&item=' + JSON.stringify({ goodsList }),
    })
  },
  /** 购物车 end */

  onChange(event) {
    if (event.detail == this.data.activeIndex) return;
    this.updateSubPageShowHide(event.detail);
    this.setData({
      activeIndex: event.detail,
      pageName: this.data.tabbar[event.detail].name
    })
    // 还原子页面的滚动位置
    wx.pageScrollTo({
      duration: 0,
      scrollTop: this.data.scrollTopArray[event.detail]
    })
  },
  // 记录每个子页面的滚动位置
  onPageScroll(e) {
    this.data.scrollTopArray[this.data.activeIndex] = e.scrollTop;
  },
  // 更新组件的show hide 生命周期
  updateSubPageShowHide(currentIndex) {
    this.data.tabbar.forEach(function (value, i) {
      if (i == currentIndex) {
        value.selected = true;
        wx.setNavigationBarTitle({
          title: value.name,
        })
      } else {
        value.selected = false;
      }
    })
    this.setData({
      tabbar: this.data.tabbar,
    })
  },
  onReady: function () {

  },
  onUnload: function () {

  },
  onPullDownRefresh: function () {

  },
  onReachBottom: function () {

  }
})