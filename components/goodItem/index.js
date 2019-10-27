Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    goodItem: {
      type: Object,
      value: {}
    }
  },
  data: {

  },
  methods: {
    toDetail() {
      const str = JSON.stringify(this.data.goodItem)
      wx.navigateTo({
        url: '../../pages/goodDetail/index?item=' + str
      })
    }
  }
})