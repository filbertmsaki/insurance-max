/** Matches a menu destination, including any tab query parameters it requires. */
export function isNavLinkActive(
  pathname: string,
  search: string,
  to: string,
): boolean {
  const [targetPath, targetSearch = ''] = to.split('?');
  if (pathname !== targetPath && !pathname.startsWith(targetPath + '/'))
    return false;
  const actual = new URLSearchParams(search);
  return [...new URLSearchParams(targetSearch)].every(
    ([key, value]) => actual.get(key) === value,
  );
}
