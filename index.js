const methods = require('methods')
const apibGenerator = require('./apib-generator')
const fs = require('fs')
const pathToRegexp = require('path-to-regexp')
const capture = require('./capture')

class Action {
  constructor (group) {
    this.group = group
    this.docs = {
      method: '',
      title: '',
      descriptions: [],
      url: ''
    }
    this.parameters = []
    this.queries = []
    this.requestBodies = []
    this.responseBodies = []
    this.example = 0
    for (const method of methods) {
      this[method] = (url, params) => this.method(method).url(url, params)
    }
  }
  method (method) {
    this.docs.method = method.toUpperCase()
    return this
  }
  title (title) {
    this.docs.title = title
    return this
  }
  desc (...descriptions) {
    this.docs.descriptions = descriptions
    return this
  }
  url (url, parameters) {
    this.docs.url = url.startsWith('/') ? url.substr(1) : url
    if (this.docs.url.endsWith('/')) this.docs.url = this.docs.url.substr(0, this.docs.url.length - 1)
    if (parameters) {
      this.params(parameters)
      url = pathToRegexp.compile(url)(parameters)
    }
    return url
  }
  val (value, ...descriptions) {
    return capture(value).desc(...descriptions)
  }
  anotherExample () {
    this.example++
    return this
  }
  params (parameters, returnProxy = false) {
    const captured = capture(parameters)
    this.parameters[this.example] = captured
    return returnProxy ? captured : capture.undo(parameters)
  }
  query (queries, returnProxy = false) {
    const captured = capture(queries)
    this.queries[this.example] = captured
    return returnProxy ? captured : capture.undo(queries)
  }
  reqBody (body, description, returnProxy = false) {
    const captured = capture(body)
    if (description) captured.desc(description)
    this.requestBodies[this.example] = captured
    return returnProxy ? captured : capture.undo(body)
  }
  resBody (body) {
    const captured = capture(body)
    this.responseBodies[this.example] = captured
    return captured
  }
  is (collectFn) {
    const collect = collectFn(this)
    return collect instanceof Promise ? collect.then(() => this) : this
  }
  uncapture (object) {
    return capture.undo(object)
  }
}

class Group {
  constructor (parent) {
    this.depth = parent ? parent.depth + 1 : 0
    this.children = []
    this.parent = parent
    this.actions = []
    this.docs = {
      title: '',
      descriptions: [],
      schemes: [],
      host: '',
      basePath: ''
    }
  }
  title (title) {
    this.docs.title = title
    return this
  }
  desc (...descriptions) {
    this.docs.descriptions = descriptions
    return this
  }
  scheme (...schemes) {
    this.docs.schemes = schemes
    return this
  }
  host (host) {
    this.docs.host = host
    return this
  }
  basePath (basePath, parameters) {
    if (basePath.startsWith('/')) basePath = basePath.substr(1)
    if (basePath.endsWith('/')) basePath = basePath.substr(0, basePath.length - 1)
    this.docs.basePath = basePath
    if (parameters) {
      this.params(parameters)
    }
    return this
  }
  val (value, ...descriptions) {
    return capture(value).desc(...descriptions)
  }
  params (parameters, returnProxy = false) {
    this.parameters = capture(parameters)
    return returnProxy ? this.parameters : capture.undo(parameters)
  }
  query (queries, returnProxy = false) {
    this.queries = capture(queries)
    return returnProxy ? this.queries : capture.undo(queries)
  }
  group (title) {
    let groupIndex = this.children.findIndex(g => g.title === title)
    if (groupIndex >= 0) return this.children[groupIndex]
    const group = new Group(this).title(title)
    this.children.push(group)
    return group
  }
  action (title) {
    const action = new Action(this).title(title)
    this.actions.push(action)
    return action
  }
  is (collectFn) {
    const collect = collectFn(this)
    return collect instanceof Promise ? collect.then(() => this) : this
  }
  uncapture (object) {
    return capture.undo(object)
  }
  emit (file, generator = apibGenerator, options = {}) {
    fs.writeFileSync(file, generator.generate(this, options))
  }
}

module.exports = new Group()
