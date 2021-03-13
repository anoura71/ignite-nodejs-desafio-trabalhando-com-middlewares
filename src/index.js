const express = require('express');
const cors = require('cors');

const { v4: uuidv4, validate } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

const users = [];


/** Middleware: Verificar se o username já está cadastrado. */
function checksExistsUserAccount(request, response, next) {
  const { username } = request.headers;

  const user = users.find(user =>
    user.username === username,
  );
  if (!user) {
    return response.status(404).json({ error: 'Username does not exist!' });
  }

  request.user = user;

  return next();
}


/** Middleware: Verificar se o usuário está habilitado a criar novas tarefas. */
function checksCreateTodosUserAvailability(request, response, next) {
  const { user } = request;

  // Verifica se está no plano gratuito, mas já criou 10 tarefas
  if (!user.pro && user.todos.length === 10) {
    return response.status(403).json({ error: 'User is not Pro and has already created 10 todos!' });
  }

  return next();
}


/** Middleware: Verificar se a tarefa está cadastrada e pertence ao usuário. */
function checksTodoExists(request, response, next) {
  const { username } = request.headers;
  const { id } = request.params;

  // Verifica se o usuário existe
  const user = users.find(user =>
    user.username === username,
  );
  if (!user) {
    return response.status(404).json({ error: 'Username does not exist!' });
  }

  // Verifica se o id é uma UUID válida
  if (!validate(id)) {
    return response.status(400).json({ error: 'Id is not a valid uuid!' });
  }

  // Verifica se o id pertence a uma tarefa do usuário informado
  const todo = user.todos.find((todo) =>
    todo.id === id,
  );
  if (!todo) {
    return response.status(404).json({ error: 'Id does not belong to a todo of this user!' });
  }

  request.user = user;
  request.todo = todo;

  return next();
}


/** Middleware: Verificar se o usuário está cadastrado. */
function findUserById(request, response, next) {
  const { id } = request.params;

  const user = users.find((user) =>
    user.id === id,
  );
  if (!user) {
    return response.status(404).json({ error: 'User id not found!' });
  }

  request.user = user;

  return next();
}


app.post('/users', (request, response) => {
  const { name, username } = request.body;

  const usernameAlreadyExists = users.some((user) => user.username === username);

  if (usernameAlreadyExists) {
    return response.status(400).json({ error: 'Username already exists' });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: []
  };

  users.push(user);

  return response.status(201).json(user);
});


app.get('/users/:id', findUserById, (request, response) => {
  const { user } = request;

  return response.json(user);
});


app.patch('/users/:id/pro', findUserById, (request, response) => {
  const { user } = request;

  if (user.pro) {
    return response.status(400).json({ error: 'Pro plan is already activated.' });
  }

  user.pro = true;

  return response.json(user);
});


app.get('/todos', checksExistsUserAccount, (request, response) => {
  const { user } = request;

  return response.json(user.todos);
});


app.post('/todos', checksExistsUserAccount, checksCreateTodosUserAvailability, (request, response) => {
  const { title, deadline } = request.body;
  const { user } = request;

  const newTodo = {
    id: uuidv4(),
    title,
    deadline: new Date(deadline),
    done: false,
    created_at: new Date()
  };

  user.todos.push(newTodo);

  return response.status(201).json(newTodo);
});


app.put('/todos/:id', checksTodoExists, (request, response) => {
  const { title, deadline } = request.body;
  const { todo } = request;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return response.json(todo);
});


app.patch('/todos/:id/done', checksTodoExists, (request, response) => {
  const { todo } = request;

  todo.done = true;

  return response.json(todo);
});


app.delete('/todos/:id', checksExistsUserAccount, checksTodoExists, (request, response) => {
  const { user, todo } = request;

  const todoIndex = user.todos.indexOf(todo);

  if (todoIndex === -1) {
    return response.status(404).json({ error: 'Todo not found' });
  }

  user.todos.splice(todoIndex, 1);

  return response.status(204).send();
});

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById
};