// components/confirm/index.js
Component({
  options: {
    addGlobalClass: true,
  },
  /**
   * 组件的属性列表
   */
  properties: {
    isShow: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    
  },

  /**
   * 组件的方法列表
   */
  methods: {
    confirm: function(e) {
      this.triggerEvent('confirm')
    },
    cancle: function(e) {
      this.triggerEvent('cancel')
    }
  }
})
