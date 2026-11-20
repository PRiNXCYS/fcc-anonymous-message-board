# Anonymous Message Board

An anonymous board API with boards, threads, and replies. Post deletion is authorized with the `delete_password` supplied when the post was created; passwords are stored as bcrypt hashes. Reported posts and password hashes are never included in GET responses.

Data is held in memory and is cleared when the server restarts.

## API

- `POST /api/threads/:board` with `text` and `delete_password` creates a thread.
- `GET /api/threads/:board` returns up to 10 most recently bumped threads and their 3 newest replies.
- `DELETE /api/threads/:board` with `thread_id` and `delete_password` deletes a thread.
- `PUT /api/threads/:board` with `thread_id` reports a thread.
- `POST /api/replies/:board` with `thread_id`, `text`, and `delete_password` adds a reply.
- `GET /api/replies/:board?thread_id=...` returns a thread and all its replies.
- `DELETE /api/replies/:board` with `thread_id`, `reply_id`, and `delete_password` marks a reply as `[deleted]`.
- `PUT /api/replies/:board` with `thread_id` and `reply_id` reports a reply.

Start the app with `npm start`.
