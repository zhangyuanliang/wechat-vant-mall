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
    changeRadio() {
      this.triggerEvent('select', this.data.index)
    },
    
  }
})