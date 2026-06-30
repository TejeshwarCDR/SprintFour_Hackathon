export const throwIfSupabaseError = (error) => {
  if (error) {
    throw error;
  }
};
