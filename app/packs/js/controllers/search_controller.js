/* eslint-disable no-underscore-dangle */
import * as Mousetrap from 'mousetrap'
import { Controller } from 'stimulus'
import { Turbo } from '@hotwired/turbo-rails'
import { autocomplete } from '@algolia/autocomplete-js'
import debouncePromise from '@/js/helpers/debounce_promise'

export default class extends Controller {
  static targets = ['autocomplete', 'button', 'hiddenId', 'visibleLabel'];

  debouncedFetch = debouncePromise(fetch, this.debounceTimeout);

  get translationKeys() {
    let keys
    try {
      keys = JSON.parse(this.autocompleteTarget.dataset.translationKeys)
    } catch (error) {
      keys = {}
    }

    return keys
  }

  get debounceTimeout() {
    return this.autocompleteTarget.dataset.debounceTimeout
  }

  get searchResource() {
    return this.autocompleteTarget.dataset.searchResource
  }

  get searchPath() {
    return this.autocompleteTarget.dataset.searchPath
  }

  get isGlobalSearch() {
    return this.searchResource === 'global'
  }

  get isBelongsToSearch() {
    return this.searchResource === 'belongs_to'
  }

  get searchUrl() {
    console.log(this.isBelongsToSearch, this.searchPath)
    if (this.isGlobalSearch) {
      return `${window.Avo.configuration.root_path}/avo_api/search`
    }

    if (this.isBelongsToSearch) {
      return this.searchPath
    }

    return `${window.Avo.configuration.root_path}/avo_api/${this.searchResource}/search`
  }

  handleOnSelect({ item }) {
    console.log('this->', this, this.isBelongsToSearch)
    if (this.isBelongsToSearch) {
      console.log('items->', item, this.hiddenIdTarget)
      this.hiddenIdTarget.setAttribute('value', item._id)
      this.buttonTarget.setAttribute('value', item._label)
      return
    }

    return Turbo.visit(item._url, { action: 'replace' })
  }

  addSource(resourceName, data) {
    const that = this

    return {
      sourceId: resourceName,
      getItems: () => data.results,
      onSelect: that.handleOnSelect.bind(that),
      templates: {
        header() {
          return `${data.header.toUpperCase()} ${data.help}`
        },
        item({ item, createElement }) {
          let element = ''

          if (item._avatar) {
            let classes

            switch (item._avatar_type) {
              default:
              case 'circle':
                classes = 'rounded-full'
                break
              case 'rounded':
                classes = 'rounded'
                break
            }

            element += `<img src="${item._avatar}" alt="${item._label}" class="flex-shrink-0 w-8 h-8 my-[2px] inline mr-2 ${classes}" />`
          }
          element += `<div>${item._label}`

          if (item._description) {
            element += `<div class="aa-ItemDescription">${item._description}</div>`
          }

          element += '</div>'

          return createElement('div', {
            class: 'flex',
            dangerouslySetInnerHTML: {
              __html: element,
            },
          })
        },
        noResults() {
          return that.translationKeys.no_item_found.replace(
            '%{item}',
            resourceName,
          )
        },
      },
    }
  }

  showSearchPanel() {
    this.autocompleteTarget.querySelector('button').click()
  }

  connect() {
    const that = this
    console.log('this.debounceTimeout->', this.debounceTimeout)

    this.buttonTarget.onclick = () => this.showSearchPanel()

    if (this.isGlobalSearch) {
      Mousetrap.bind(['command+k', 'ctrl+k'], () => this.showSearchPanel())
    }

    autocomplete({
      container: this.autocompleteTarget,
      placeholder: this.translationKeys.placeholder,
      translations: {
        detachedCancelButtonText: this.translationKeys.cancel_button,
      },
      openOnFocus: true,
      detachedMediaQuery: '',
      getSources: ({ query }) => {
        const endpoint = `${that.searchUrl}?q=${query}`

        return that
          .debouncedFetch(endpoint)
          .then((response) => response.json())
          .then((data) => Object.keys(data).map((resourceName) => that.addSource(resourceName, data[resourceName])))
      },
    })
  }
}
