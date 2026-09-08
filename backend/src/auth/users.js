import bcrypt from 'bcryptjs';

const users = [
  {
    id: 1,
    username: 'demo',
    passwordHash: bcrypt.hashSync('demo123', 10),
  },
];

export function findByUsername(username) {
  return users.find((user) => user.username === username);
}

export function findById(id) {
  return users.find((user) => user.id === id);
}
