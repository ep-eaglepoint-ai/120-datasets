module.exports = {
  createOrder: async (orderData, customerId, io) => {
    return { _id: 'mock-order-id', ...orderData, customerId, status: 'created' };
  }
};

