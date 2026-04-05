import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('shows splash screen text initially', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Loading nrgy app...')
  })
})
