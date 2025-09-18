export const calculateAge = (dateOfBirth: string): number | null => {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  // Check if the date is valid
  if (isNaN(birthDate.getTime())) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  // Adjust age if birthday hasn't occurred this year yet
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
};

export const formatAge = (age: number | null): string => {
  if (age === null || age === undefined) return '';
  return `${age} year${age !== 1 ? 's' : ''} old`;
};

export const validateDateOfBirth = (dateOfBirth: string): { isValid: boolean; error?: string } => {
  if (!dateOfBirth) return { isValid: true }; // Optional field

  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  if (isNaN(birthDate.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }

  if (birthDate > today) {
    return { isValid: false, error: 'Date of birth cannot be in the future' };
  }

  const age = calculateAge(dateOfBirth);
  if (age !== null && age > 150) {
    return { isValid: false, error: 'Age cannot exceed 150 years' };
  }

  return { isValid: true };
};