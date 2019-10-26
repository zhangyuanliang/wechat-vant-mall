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
    toDetails() {
      this.triggerEvent('click')
    }
  }
})