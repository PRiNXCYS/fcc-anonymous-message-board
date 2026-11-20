'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const boards = Object.create(null);

function findThread(board, threadId) {
  const threads = boards[board] || [];
  return threads.find(thread => thread._id === threadId);
}

function publicReply(reply) {
  return {
    _id: reply._id,
    text: reply.text,
    created_on: reply.created_on
  };
}

function publicThread(thread, replies) {
  return {
    _id: thread._id,
    text: thread.text,
    created_on: thread.created_on,
    bumped_on: thread.bumped_on,
    board: thread.board,
    replies: (replies || thread.replies).map(publicReply),
    replycount: thread.replies.length
  };
}

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function requiredStrings(body, fields) {
  body = body || {};
  return fields.every(field => typeof body[field] === 'string' && body[field].length > 0);
}

module.exports = function (app) {
  app.route('/api/threads/:board')
    .post(async function (req, res, next) {
      if (!requiredStrings(req.body, ['text', 'delete_password'])) {
        return res.status(400).type('text').send('text and delete_password are required');
      }

      try {
        const now = new Date();
        const thread = {
          _id: newId(),
          text: req.body.text,
          created_on: now,
          bumped_on: now,
          reported: false,
          delete_password: await bcrypt.hash(req.body.delete_password, 10),
          replies: [],
          board: req.params.board
        };
        if (!boards[req.params.board]) boards[req.params.board] = [];
        boards[req.params.board].push(thread);
        res.status(201).json(publicThread(thread));
      } catch (error) {
        next(error);
      }
    })
    .get(function (req, res) {
      const threads = (boards[req.params.board] || [])
        .slice()
        .sort((a, b) => b.bumped_on - a.bumped_on)
        .slice(0, 10)
        .map(thread => {
          const replies = thread.replies
            .slice()
            .sort((a, b) => b.created_on - a.created_on)
            .slice(0, 3);
          return publicThread(thread, replies);
        });
      res.json(threads);
    })
    .delete(async function (req, res, next) {
      if (!requiredStrings(req.body, ['thread_id', 'delete_password'])) {
        return res.status(400).type('text').send('thread_id and delete_password are required');
      }
      const threads = boards[req.params.board] || [];
      const index = threads.findIndex(thread => thread._id === req.body.thread_id);
      if (index === -1) return res.type('text').send('incorrect password');

      try {
        if (await bcrypt.compare(req.body.delete_password, threads[index].delete_password)) {
          threads.splice(index, 1);
          return res.type('text').send('success');
        }
        res.type('text').send('incorrect password');
      } catch (error) {
        next(error);
      }
    })
    .put(function (req, res) {
      const body = req.body || {};
      const threadId = body.thread_id || body.report_id;
      if (typeof threadId !== 'string' || threadId.length === 0) {
        return res.status(400).type('text').send('thread_id is required');
      }
      const thread = findThread(req.params.board, threadId);
      if (!thread) return res.status(404).type('text').send('thread not found');
      thread.reported = true;
      res.type('text').send('reported');
    });

  app.route('/api/replies/:board')
    .post(async function (req, res, next) {
      if (!requiredStrings(req.body, ['text', 'delete_password', 'thread_id'])) {
        return res.status(400).type('text').send('text, delete_password, and thread_id are required');
      }
      const thread = findThread(req.params.board, req.body.thread_id);
      if (!thread) return res.status(404).type('text').send('thread not found');

      try {
        const reply = {
          _id: newId(),
          text: req.body.text,
          created_on: new Date(),
          reported: false,
          delete_password: await bcrypt.hash(req.body.delete_password, 10)
        };
        thread.replies.push(reply);
        thread.bumped_on = reply.created_on;
        res.status(201).json({
          _id: reply._id,
          text: reply.text,
          created_on: reply.created_on,
          board: req.params.board
        });
      } catch (error) {
        next(error);
      }
    })
    .get(function (req, res) {
      const thread = findThread(req.params.board, req.query.thread_id);
      if (!thread) return res.status(404).type('text').send('thread not found');
      res.json(publicThread(thread));
    })
    .delete(async function (req, res, next) {
      if (!requiredStrings(req.body, ['thread_id', 'reply_id', 'delete_password'])) {
        return res.status(400).type('text').send('thread_id, reply_id, and delete_password are required');
      }
      const thread = findThread(req.params.board, req.body.thread_id);
      const reply = thread && thread.replies.find(item => item._id === req.body.reply_id);
      if (!reply) return res.type('text').send('incorrect password');

      try {
        if (await bcrypt.compare(req.body.delete_password, reply.delete_password)) {
          reply.text = '[deleted]';
          return res.type('text').send('success');
        }
        res.type('text').send('incorrect password');
      } catch (error) {
        next(error);
      }
    })
    .put(function (req, res) {
      if (!requiredStrings(req.body, ['thread_id', 'reply_id'])) {
        return res.status(400).type('text').send('thread_id and reply_id are required');
      }
      const thread = findThread(req.params.board, req.body.thread_id);
      const reply = thread && thread.replies.find(item => item._id === req.body.reply_id);
      if (!reply) return res.status(404).type('text').send('reply not found');
      reply.reported = true;
      res.type('text').send('reported');
    });

};
