Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    disabled: {
      type: Boolean,
      value: true
    }
  },
  data: {
    second: 60,
    time: 0,
    text: '获取验证码'
  },
  methods: {
    sendMsg: function () {
      if (!this.data.disabled) {
        this.run()
        this.setData({
          disabled: true
        })
        this.triggerEvent('send')
      }
    },
    run: function () {
      this.setData({
        time: this.data.second
      })
      this.timer()
    },
    stop: function () {
      this.setData({
        time: 0,
        disabled: false
      })
    },
    timer: function () {
      if (this.data.time > 0) {
        this.setData({
          text: this.data.time + 's'
        })
        this.setData({
          time: --this.data.time
        })
        setTimeout((this.timer).bind(this), 1000)
      } else {
        this.setData({
          text: '点击获取'
        })
        this.stop()
      }
    }
  }
  
})