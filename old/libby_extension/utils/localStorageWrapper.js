// API Key Methods:
// localStorage.setItem('YourItem', response.data)
// localStorage.getItem('YourItem')
// localStorage.removeItem('YourItem')

// key is a string
export const readLocalStorage = (key) => {
  const stor_string = localStorage.getItem(key);
  const stor_obj = JSON.parse(stor_string) || {};
  return stor_obj;
};

// key is a string, value is any
export const writeLocalStorage = (key, value) => {
  const stor_string = JSON.stringify(value);
  localStorage.setItem(key, stor_string);
  return;
};
