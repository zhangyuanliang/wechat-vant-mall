Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    
  },
  data: {
    userInfo: {
      type: Object,
      value: {}
    }
  },
  methods: {
    changeRadio() {
      this.triggerEvent('select', this.data.index)
    },
    toUserInfo() {
      const url = '../userInfo/index'
      if (!this.data.userInfo.name) {

      }
      wx.navigateTo({
        url
      })
    },
    toAddress() {
      wx.navigateTo({
        url: '../../pages/manageAddress/index'
      })
    }
  }
})