const _map = require('lodash/fp/map')
const dateFormat = require('dateformat')
const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')
const fx = require('mkdir-recursive')

module.exports = function (args, callback) {
  callback = callback || function () {}
  if (args.published === undefined) args.published = true

  if (!args.source) {
    callback(new Error('No source Ghost app specified'), 0)
  } else if (!fs.existsSync(args.source)) {
    callback(new Error('Source app does not exist'), 0)
  } else if (!args.destination) {
    callback(new Error('No destination directory specified'), 0)
  } else {
    if (!fs.existsSync(args.destination)) { fs.mkdirSync(args.destination) }
    let where
    if (args.published && !args.drafts) {
      where = ' WHERE status IS NOT "draft"'
    } else if (!args.published && args.drafts) {
      where = ' WHERE status IS "draft"'
    } else { where = '' }

    var db = new sqlite3.Database(path.join(args.source, 'content/data/ghost.db'), function (err, db) {
      if (err) callback(err, 0)
    })

    db.serialize(function () {
      let prefix
      db.each('SELECT * FROM posts' + where, function (err, row) {
        if (err) callback(err, 0)
        if (row.status === 'draft') {
          prefix = 'draft-'
        } else {
          prefix = dateFormat(new Date(row.published_at), 'yyyy-mm-dd-')
        }
        var name = prefix + row.slug
        fx.mkdirSync(path.join(args.destination, name))
        db.all(`SELECT tags.name FROM posts_tags JOIN tags ON posts_tags.tag_id = tags.id WHERE posts_tags.post_id = ${row.id}`,
          function (err, tags) {
            if (err) callback(err, 0)
            var outFile = path.join(args.destination, name, 'index.md')
            var frontMatter = '---\n'
            frontMatter += `title: ${row.title}\n`
            if (row.status !== 'draft') frontMatter += `date: ${prefix}\n`
            frontMatter += 'layout: post\n'
            const tagsList = _map('name', tags).join(', ')
            frontMatter += `tags: ${tagsList}\n`
            frontMatter += '---\n'
            const post = frontMatter + row.markdown
            try {
              fs.writeFileSync(outFile, post)
            } catch (err) {
              callback(err, 0)
            }   
          })
      }, function (err, count) { 
        db.close()
        callback(err, count)
      })
    })
  }
}
