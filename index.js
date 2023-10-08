const isGHP = /\.github\.io$/.test(location.hostname)

function structureContent() {
  let main = document.querySelector('main')
  let restructured = document.createElement('main')

  let children = []
  Array.from(main?.children || []).forEach((el, idx) => {
    if (/^\s*{#.*}\s*$/.test(el.textContent)) {      
      let i = children.length-1
      let prior = children[i]
      while (prior.tagName !== 'P' && i > 0) prior = children[--i]
      if (prior.tagName === 'P') prior.id = el.textContent.trim().slice(2,-1)
    } else {
      children.push(el)
    }
  })

  let currentSection = restructured;
  let sectionParam
  for (let i = 0; i < children.length; i++) {
    let el = children[i]
    if (el.tagName[0] === 'H' && isNumeric(el.tagName.slice(1))) {
      let heading = el
      let sectionLevel = parseInt(heading.tagName.slice(1))
      if (currentSection) {
        (Array.from(currentSection.children))
          .filter(child => !/^H\d/.test(child.tagName))
          .filter(child => !/PARAM/.test(child.tagName))
          .forEach((child, idx) => { 
            let segId = `${currentSection.getAttribute('data-id') || 1}.${idx+1}`
            child.setAttribute('data-id', segId)
            if (!child.id) child.id = segId
            child.className = 'segment'
          })
      }

      currentSection = document.createElement('section')
      currentSection.classList.add(`section-${sectionLevel}`)
      Array.from(heading.classList).forEach(c => currentSection.classList.add(c))
      sectionParam = heading.nextElementSibling?.tagName === 'PARAM'
        ? heading.nextElementSibling
        : null
      if (sectionParam) {
        sectionParam.classList.forEach(c => currentSection.classList.add(c))
      }
      heading.className = ''
      if (heading.id) {
        currentSection.id = heading.id
        heading.removeAttribute('id')
      }

      currentSection.innerHTML += heading.outerHTML
      if (!heading.innerHTML.trim()) currentSection.firstChild?.remove()

      let headings = [...restructured.querySelectorAll(`H${sectionLevel-1}`)]
      let parent = sectionLevel === 1 || headings.length === 0 ? restructured : headings.pop()?.parentElement
      parent?.appendChild(currentSection)
      currentSection.setAttribute('data-id', computeDataId(currentSection))

    } else {
      if (el !== sectionParam) currentSection.innerHTML += el.outerHTML
    }
  }

  restructured.querySelectorAll('section').forEach((section) => {
  if (section.classList.contains('cards') && !section.classList.contains('wrapper')) {
    section.classList.remove('cards')
    let wrapper = document.createElement('section')
    wrapper.className = 'cards wrapper'
    Array.from(section.children).slice(1).forEach(card => {
      wrapper.appendChild(card)
      card.classList.add('card')
      let heading = card.querySelector('h1, h2, h3, h4, h5, h6')
      if (heading) heading.remove()
      let img = card.querySelector('p > img')
      if (img) img.parentElement?.replaceWith(img)
      let link = card.querySelector('p > a')
      if (link) link.parentElement?.replaceWith(link)
    })
    section.appendChild(wrapper)
    }
  })

  main?.replaceWith(restructured)
}

function isNumeric(arg) { return !isNaN(arg) }

function computeDataId(el) {
  let dataId = []
  // if (!el.parentElement) dataId.push(1)
  while (el.parentElement) {
    let siblings = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName)
    dataId.push(siblings.indexOf(el) + 1)
    el = el.parentElement
  }
  return dataId.reverse().join('.')
}

function convertWcTagsToElements(root) {
  // Converts Web Component tags to HTML elements
  root = root || document.querySelector('main')

  root.querySelectorAll('a').forEach(anchorElem => {
    let link = new URL(anchorElem.href)
    if (isGHP && link.origin === location.origin && link.pathname.indexOf(`/${config.repo}/`) !== 0) anchorElem.href = `/${config.repo}${link.pathname}`
  })

  Array.from(root.querySelectorAll('img'))
    .forEach(img => {
      if (img.parentElement?.classList.contains('card')) return
      let ezImage = document.createElement('ez-image')
      ezImage.setAttribute('src', img.src)
      ezImage.setAttribute('alt', img.alt)
      ezImage.setAttribute('left', '');
      img.parentNode.replaceWith(ezImage)
    })

  let regex = new RegExp(`^\\s*\\.\\w+-\\w+\\s*`)
  Array.from(root.querySelectorAll('p'))
    .filter(p => regex.test(p.textContent || ''))
    .forEach(p => {
      let tag = p.textContent.trim().split(' ')[0].slice(1).trim()
      let html = componentHtml(p, tag)
      let el = new DOMParser().parseFromString(html, 'text/html').children[0].children[1].children[0]
      p.parentNode?.replaceChild(el, p)
    })
}

function componentHtml(el, tag) {
  let lines = el.innerHTML?.trim().split('\n').map(line => line.trim()) || []
  if (lines.length === 0) return ''
  let headLine = lines[0]
  let attrs = asAttrs(parseHeadline(headLine))

  let slot = ''
  if (lines.length > 1) {
    let listItems = []
    lines.slice(1)
      .map(l => l.replace(/^\s*/, ''))
      .forEach(line => {
        if (line === '-') listItems.push('- ')
        else if (/^-\s+.+/.test(line)) listItems.push(line)
        else listItems[listItems.length-1] += `${line}`
      })
    slot = marked.parse(listItems.join('\n'))
  }
  return `<${tag} ${attrs}>\n${slot}</${tag}>`
}

function parseHeadline(s) {
  let tokens = []
  s = s.replace(/”/g,'"').replace(/”/g,'"').replace(/’/g,"'")
  s?.match(/[^\s"]+|"([^"]*)"/gmi)?.forEach(token => {
    if (tokens.length > 0 && tokens[tokens.length-1].indexOf('=') === tokens[tokens.length-1].length-1) tokens[tokens.length-1] = `${tokens[tokens.length-1]}${token}`
    else tokens.push(token)
  })
  return Object.fromEntries(tokens.slice(1).map(token => {
    if (token.indexOf('=') > 0) {
      let [key, value] = token.split('=')
      return [key, value[0] === '"' && value[value.length-1] === '"' ? value.slice(1, -1) : value]
    } else return [token, "true"]
  }))
}

function asAttrs(obj) {
  return Object.entries(obj).map(([k, v]) => v === 'true' ? k : `${k}="${v}"`).join(' ')
}

async function getGhFile(acct, repo, branch, path) {
  let resp = await fetch(`https://api.github.com/repos/${acct}/${repo}/contents/${path}?ref=${branch}`)
  if (resp.ok) {
    resp = await resp.json()
    return decodeURIComponent(escape(atob(resp.content)))
  } else{
    console.log(`Github API failed: status=${resp.status}, retrying with raw.githubusercontent.com`)
    resp = await fetch(`https://raw.githubusercontent.com/${acct}/${repo}/${branch}/${path}`)
    if (resp.ok) return await resp.text()
  }
}

function addWebComponentsScript(url) {
  let wcScriptEl = document.createElement('script')
  wcScriptEl.setAttribute('type', 'module')
  wcScriptEl.setAttribute('src', url)
  wcScriptEl.addEventListener('load', () => { 
    console.log(`Web Components script ${url} loaded`)
  })
  document.body.appendChild(wcScriptEl)
}

async function init() {

  console.log(config)
  config.components = config.components ? JSON.parse(config.components) : []
  console.log(config)

  convertWcTagsToElements()
  structureContent()
  config.components.forEach(url => addWebComponentsScript(url) )
}

document.addEventListener('DOMContentLoaded', () =>  init() )
