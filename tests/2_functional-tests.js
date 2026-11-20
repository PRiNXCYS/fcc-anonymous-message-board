const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
  const board = 'functional-test';
  let threadId;
  let replyId;

  test('Creating a thread returns its public fields and security headers', function(done) {
    chai.request(server)
      .post('/api/threads/' + board)
      .send({ text: 'A new thread', delete_password: 'thread-secret' })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.status, 201);
        assert.equal(res.body.text, 'A new thread');
        assert.equal(res.body.board, board);
        assert.isString(res.body._id);
        assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
        assert.equal(res.headers['x-dns-prefetch-control'], 'off');
        assert.equal(res.headers['referrer-policy'], 'same-origin');
        threadId = res.body._id;
        done();
      });
  });

  test('Listing threads returns no private fields and only the three newest replies', function(done) {
    const addReply = function(index, callback) {
      chai.request(server)
        .post('/api/replies/' + board)
        .send({ thread_id: threadId, text: 'Reply ' + index, delete_password: 'reply-secret' })
        .end(callback);
    };

    addReply(1, function(err) {
      assert.isNull(err);
      addReply(2, function(err) {
        assert.isNull(err);
        addReply(3, function(err) {
          assert.isNull(err);
          addReply(4, function(err) {
            assert.isNull(err);
            chai.request(server)
              .get('/api/threads/' + board)
              .end(function(err, res) {
                assert.isNull(err);
                assert.equal(res.status, 200);
                const listed = res.body.find(thread => thread._id === threadId);
                assert.isObject(listed);
                assert.equal(listed.replies.length, 3);
                assert.equal(listed.replycount, 4);
                assert.equal(listed.replies[0].text, 'Reply 4');
                assert.notProperty(listed, 'delete_password');
                assert.notProperty(listed, 'reported');
                listed.replies.forEach(reply => {
                  assert.notProperty(reply, 'delete_password');
                  assert.notProperty(reply, 'reported');
                });
                done();
              });
          });
        });
      });
    });
  });

  test('Deleting a thread with the wrong password fails', function(done) {
    chai.request(server)
      .delete('/api/threads/' + board)
      .send({ thread_id: threadId, delete_password: 'wrong' })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Reporting a thread responds with reported', function(done) {
    chai.request(server)
      .put('/api/threads/' + board)
      .send({ thread_id: threadId })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.text, 'reported');
        done();
      });
  });

  test('Creating a reply returns its public fields', function(done) {
    chai.request(server)
      .post('/api/replies/' + board)
      .send({ thread_id: threadId, text: 'A reply for deletion', delete_password: 'reply-secret' })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.status, 201);
        assert.equal(res.body.text, 'A reply for deletion');
        assert.equal(res.body.board, board);
        replyId = res.body._id;
        done();
      });
  });

  test('Getting a thread returns all replies without private fields', function(done) {
    chai.request(server)
      .get('/api/replies/' + board)
      .query({ thread_id: threadId })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.status, 200);
        assert.equal(res.body._id, threadId);
        assert.equal(res.body.replies.length, 5);
        assert.equal(
          new Date(res.body.bumped_on).getTime(),
          new Date(res.body.replies[res.body.replies.length - 1].created_on).getTime()
        );
        assert.notProperty(res.body, 'delete_password');
        assert.notProperty(res.body, 'reported');
        res.body.replies.forEach(reply => {
          assert.notProperty(reply, 'delete_password');
          assert.notProperty(reply, 'reported');
        });
        done();
      });
  });

  test('Deleting a reply with the wrong password fails', function(done) {
    chai.request(server)
      .delete('/api/replies/' + board)
      .send({ thread_id: threadId, reply_id: replyId, delete_password: 'wrong' })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Deleting a reply with the correct password keeps it as deleted', function(done) {
    chai.request(server)
      .delete('/api/replies/' + board)
      .send({ thread_id: threadId, reply_id: replyId, delete_password: 'reply-secret' })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.text, 'success');
        chai.request(server)
          .get('/api/replies/' + board)
          .query({ thread_id: threadId })
          .end(function(err, threadRes) {
            assert.isNull(err);
            assert.equal(threadRes.body.replies.find(reply => reply._id === replyId).text, '[deleted]');
            done();
          });
      });
  });

  test('Reporting a reply responds with reported', function(done) {
    chai.request(server)
      .put('/api/replies/' + board)
      .send({ thread_id: threadId, reply_id: replyId })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.text, 'reported');
        chai.request(server)
          .get('/api/replies/' + board)
          .query({ thread_id: threadId })
          .end(function(err, threadRes) {
            assert.isNull(err);
            const reportedReply = threadRes.body.replies.find(reply => reply._id === replyId);
            assert.isObject(reportedReply);
            assert.notProperty(reportedReply, 'reported');
            done();
          });
      });
  });

  test('Deleting a thread with the correct password succeeds', function(done) {
    chai.request(server)
      .delete('/api/threads/' + board)
      .send({ thread_id: threadId, delete_password: 'thread-secret' })
      .end(function(err, res) {
        assert.isNull(err);
        assert.equal(res.text, 'success');
        done();
      });
  });

});
