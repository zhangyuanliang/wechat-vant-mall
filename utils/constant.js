// export const BASE_URL = 'http://172.31.98.83:8087/'
// export const BASE_URL = 'http://172.31.99.66:8087/'// 勇波
// export const BASE_URL = 'https://apidev.ely.work/' // 开发
export const BASE_URL = 'https://apitest.ely.work/' // 测试
// export const BASE_URL = 'https://api.ely.work/' // 正式环境

export const defaultTimeout = 10000

export const defaultContentType = 'application/x-www-form-urlencoded;charset=UTF-8'

export const statusCodeMap = {
  301: '永久重定向',
  400: '请求语法错误',
  401: '未授权',
  403: '禁止访问',
  404: '没有资源',
  500: '服务器错误',
  503: '服务器错误'
}

export const OPPEN_ID = 'OPPEN_ID'
export const USER_INFO = 'USER_INFO'

// 订单状态
export const ORDER_STATUS = {
  1: '待支付',
  2: '待发货',
  3: '已发货',
  4: '已完成',
  5: '已取消'
}

export const tabbarList = [
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
]
