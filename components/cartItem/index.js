Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    goodItem: {
      type: Object,
      value: {}
    },
    index: {
      type: Number
    }
  },
  data: {

  },
  methods: {
    changeRadio() {
      this.triggerEvent('select', this.data.index)
    },
    changeStepper(e) {
      const operation = e.currentTarget.dataset.operation
      if (this.data.goodItem.num <= 1 && operation === 'down') return
      const param = {
        operation,
        index: this.data.index
      }
      this.triggerEvent('changeNum', param)
    },
    toDelete() {
      this.triggerEvent('toDelete', this.data.index)
    }
  }
})